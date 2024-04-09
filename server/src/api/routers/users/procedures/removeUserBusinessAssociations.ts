import { TRPCError } from '@trpc/server';
import { Context } from '../../../../context';
import { UserResponse, RemoveUserBusinessAssociationsDto } from '../dtos';

export const removeUserBusinessAssociations = async (
  input: RemoveUserBusinessAssociationsDto,
  ctx: Context
): Promise<UserResponse> => {
  const { userId, businessIds } = input;

  return ctx.db.$transaction(async (transaction) => {
    const userWithBusinesses = await transaction.user.findUnique({
      where: {
        id: userId,
        deletedAt: null,
      },
      include: { businesses: true },
    });

    if (!userWithBusinesses) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
    }

    const currentUserBusinessesIds = userWithBusinesses.businesses.map(business => business.id);
    const invalidBusinessToRemove = businessIds.some(businessId => !currentUserBusinessesIds.includes(businessId));

    if (invalidBusinessToRemove) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'One or more businesses to remove not found in user\'s current associations' });
    }

    await transaction.user.update({
      where: { id: userId },
      data: {
        businesses: {
          disconnect: businessIds.map(id => ({ id })),
        },
      },
    });

    const updatedUser = await transaction.user.findUnique({
      where: { id: userId },
      include: { businesses: true },
    });

    if (!updatedUser) {
      throw new Error("Unexpected error: User not updated");
    }

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      role: updatedUser.role,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
      deletedAt: updatedUser.deletedAt,
    };
  });
};